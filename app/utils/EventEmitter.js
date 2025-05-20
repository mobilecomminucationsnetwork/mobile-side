// filepath: /home/furkan/Downloads/mobilecomnew/app/utils/EventEmitter.js
/**
 * A simple EventEmitter implementation for React Native
 * to replace the Node.js events module which is not available in React Native
 */
export default class EventEmitter {
  constructor() {
    this.events = {};
    this.maxListeners = 10;
  }

  /**
   * Set the maximum number of listeners for an event
   * @param {number} n - The maximum number of listeners
   * @returns {EventEmitter} - Returns this EventEmitter instance
   */
  setMaxListeners(n) {
    this.maxListeners = n;
    return this;
  }

  /**
   * Add an event listener
   * @param {string} eventName - The name of the event to listen for
   * @param {Function} listener - The callback function
   * @returns {EventEmitter} - Returns this EventEmitter instance
   */
  on(eventName, listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    if (
      this.events[eventName].length >= this.maxListeners &&
      this.maxListeners !== 0
    ) {
      console.warn(
        `Possible EventEmitter memory leak detected. ${this.events[eventName].length} ${eventName} listeners added. Use setMaxListeners() to increase limit`
      );
    }

    this.events[eventName].push(listener);
    return this;
  }

  /**
   * Add a one-time event listener
   * @param {string} eventName - The name of the event to listen for
   * @param {Function} listener - The callback function
   * @returns {EventEmitter} - Returns this EventEmitter instance
   */
  once(eventName, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.removeListener(eventName, onceWrapper);
    };
    
    this.on(eventName, onceWrapper);
    return this;
  }

  /**
   * Emit an event
   * @param {string} eventName - The name of the event to emit
   * @param {...any} args - Arguments to pass to the event listeners
   * @returns {boolean} - Returns true if the event had listeners, false otherwise
   */
  emit(eventName, ...args) {
    if (!this.events[eventName]) {
      return false;
    }

    this.events[eventName].forEach(listener => {
      listener(...args);
    });
    
    return true;
  }

  /**
   * Remove an event listener
   * @param {string} eventName - The name of the event
   * @param {Function} listener - The callback function to remove
   * @returns {EventEmitter} - Returns this EventEmitter instance
   */
  removeListener(eventName, listener) {
    if (!this.events[eventName]) {
      return this;
    }

    this.events[eventName] = this.events[eventName].filter(
      l => l !== listener
    );
    
    return this;
  }

  /**
   * Remove all listeners for an event
   * @param {string} eventName - The name of the event
   * @returns {EventEmitter} - Returns this EventEmitter instance
   */
  removeAllListeners(eventName) {
    if (eventName) {
      delete this.events[eventName];
    } else {
      this.events = {};
    }
    
    return this;
  }

  /**
   * Get the number of listeners for an event
   * @param {string} eventName - The name of the event
   * @returns {number} - Returns the number of listeners for the event
   */
  listenerCount(eventName) {
    if (!this.events[eventName]) {
      return 0;
    }
    
    return this.events[eventName].length;
  }

  /**
   * Get all listeners for an event
   * @param {string} eventName - The name of the event
   * @returns {Array<Function>} - Returns an array of listeners for the event
   */
  listeners(eventName) {
    if (!this.events[eventName]) {
      return [];
    }
    
    return [...this.events[eventName]];
  }
}