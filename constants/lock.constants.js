const LOCK_STATUS = {
    UNKNOWN: 'unknown',
    LOCKED: 'locked',
    UNLOCKED: 'unlocked'
}

const LOCK_OPERATION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    TIMEOUT: 'timeout',
    FAILED: 'failed'
}

const EVENT = {
    LOCKING: 'locking'
}

const LOCK_ACTION = {
    LOCK: 'lock',
    UNLOCK: 'unlock'
}

module.exports = {
    STATUS: LOCK_STATUS,
    OPERATION_STATUS: LOCK_OPERATION_STATUS,
    EVENT,
    ACTION: LOCK_ACTION
}
