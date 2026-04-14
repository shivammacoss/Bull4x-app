import { EventEmitter } from 'events'

/** Emits IB_COMMISSION_DISTRIBUTED after multi-level ledger + wallet credits (for sockets/notifications). */
export const ibEvents = new EventEmitter()
ibEvents.setMaxListeners(50)
