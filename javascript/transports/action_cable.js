import { createConsumer } from '@rails/actioncable'
import { received } from '../reflexes'
import { emitEvent } from '../utils'
import Deprecate from '../deprecate'

let consumer
let params
let subscription
let active
let queue = []

const initialize = (consumerValue, paramsValue) => {
  consumer = consumerValue
  params = paramsValue
  document.addEventListener('DOMContentLoaded', () => {
    active = false
    connectionStatusClass()
    if (Deprecate.enabled && consumer)
      console.warn(
        "Deprecation warning: the next version of StimulusReflex will obtain a reference to consumer via the Stimulus application object.\nPlease add 'application.consumer = consumer' to your index.js after your Stimulus application has been established, and remove the consumer key from your StimulusReflex initialize() options object."
      )
  })
  document.addEventListener('turbolinks:load', connectionStatusClass)
  document.addEventListener('turbo:load', connectionStatusClass)
}

const subscribe = controller => {
  if (subscription) return
  consumer = consumer || controller.application.consumer || createConsumer()
  const { channel } = controller.StimulusReflex
  const request = { channel, ...params }
  const identifier = JSON.stringify(request)

  subscription =
    consumer.subscriptions.findAll(identifier)[0] ||
    consumer.subscriptions.create(request, {
      received,
      connected,
      rejected,
      disconnected
    })
}

const connected = () => {
  active = true
  connectionStatusClass()
  emitEvent('stimulus-reflex:connected')
  emitEvent('stimulus-reflex:action-cable:connected')

  queue.forEach(reflex => subscription.send(reflex))
  queue = []
}

const rejected = () => {
  active = false
  connectionStatusClass()
  emitEvent('stimulus-reflex:rejected')
  emitEvent('stimulus-reflex:action-cable:rejected')
  if (Debug.enabled) console.warn('Channel subscription was rejected.')
}

const disconnected = willAttemptReconnect => {
  active = false
  connectionStatusClass()
  emitEvent('stimulus-reflex:disconnected', willAttemptReconnect)
  emitEvent('stimulus-reflex:action-cable:disconnected', willAttemptReconnect)
}

const enqueueReflex = (element, id) => {
  const reflex = element.reflexData[id]
  active ? subscription.send(reflex) : queue.push(reflex)
}

const connectionStatusClass = () => {
  const list = document.body.classList
  if (
    !(
      list.contains('stimulus-reflex-connected') ||
      list.contains('stimulus-reflex-disconnected')
    )
  ) {
    list.add(
      active ? 'stimulus-reflex-connected' : 'stimulus-reflex-disconnected'
    )
    return
  }
  if (active) {
    list.replace('stimulus-reflex-disconnected', 'stimulus-reflex-connected')
  } else {
    list.replace('stimulus-reflex-connected', 'stimulus-reflex-disconnected')
  }
}

export default {
  subscribe,
  enqueueReflex,
  initialize
}
