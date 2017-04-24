module.exports = {
  mergeSuccesses,
  setupRetry,
}

/* // EXAMPLE USAGE
  const MAX_ATTEMPTS = 2

  // can retry a single function () => search("VT") with id "single"
  setupRetry(MAX_ATTEMPTS)(() => search("VT"), "single")()
  .then(data => console.log("single data", data))
  .catch(error => console.error("single error(s)", error))

  // can be used to retry multiple functions and THEN return any successes else CATCH returns all errors
  mergeSuccesses([ // function ids correspond to their indexes
    () => search("AL"),
    () => search("CA"),
    () => search("TX"),
  ].map(setupRetry(MAX_ATTEMPTS)))
  .then(data => console.log("merged data", data))
  .catch(error => console.error("merged errors", error))
*/

// setupRetry :: Number (Task a -> Number -> _ -> Number) -> Task a // where Task refers to an uninvoked Promise
function setupRetry (maxAttempts) {
  return function retryPrep (uninvokedPromise, id, _, attemptNumber = 1) { // _ is unused; just fits function sig into .map
    return () => new Promise((resolve, reject) => { // don't begin execution just yet
      if (attemptNumber > maxAttempts) {
        return reject([])
      } // reject w [] because this is base case being spread into ...retryError
      return uninvokedPromise()
      .then(data => {
        console.log(`id ${id} attempt ${attemptNumber} success:`, data)
        return resolve(data)
      })
      .catch(error => {
        console.error(`id ${id} attempt ${attemptNumber} error:`, error)
        return setupRetry(maxAttempts)(uninvokedPromise, id, _, attemptNumber + 1)() // immediately execute after setting up retry
        .then(resolve).catch(retryError => reject([error, ...retryError])) // collect the errors from this and subsequent retries in one flat array
      })
    })
  }
}

// mergeSuccesses :: [Task a] -> Promise [a]
function mergeSuccesses (uninvokedPromises) {
  let numPending = uninvokedPromises.length // determines when all requests are finished.
  let hadSomeSuccess = false // determines whether to respond with data or errors.
  const results = []
  const errors = []
  return new Promise((resolve, reject) => {
    uninvokedPromises
    .forEach((uninvokedPromise, index) => {
      uninvokedPromise() // where we finally begin executing the promises
      .then(data => {
        hadSomeSuccess = true
        results[index] = data
        maybeEnd(resolve, reject)
      }).catch(error => {
        errors[index] = error
        maybeEnd(resolve, reject)
      })
    })
  })
  function maybeEnd (resolve, reject) {
    numPending = numPending - 1
    if (numPending === 0) {
      hadSomeSuccess ? resolve(results) : reject(errors)
    }
  }
}
