/* eslint-disable func-style */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-sequences */
const test = require("tape")
const {
  mergeSuccesses,
  setupRetry,
} = require("./retry.js")

const MAX_ATTEMPTS = 3

test("search succeeds after 1 try, returns data", t => {
  t.plan(3)
  // login -> Ok
  //   search -> Ok
  //     res Ok
  const login = () => (t.pass("logs in"), Promise.resolve("logged in"))
  const search = loginMsg => (t.pass("searches"), Promise.resolve(`${loginMsg}, searched`))
  const loginSearch = () => login().then(search)
  setupRetry(MAX_ATTEMPTS)(loginSearch)()
  .then(data => t.equal(data, "logged in, searched", "returns data"))
  .catch(t.fail)
})

test("search fails out after 3 tries, returning the 3 errors", t => {
  t.plan(4)
  // search -> Er
  //   search -> Er
  //     search -> Er
  //       res [Er, Er, Er]
  const errors = [
    () => (t.pass("errors thrice"), "❗️"),
    () => (t.pass("errors twice"), "🐞"),
    () => (t.pass("errors once"), "🙅"),
  ]
  const search = () => Promise.reject(errors.pop()())
  setupRetry(MAX_ATTEMPTS)(search)()
  .then(t.fail)
  .catch(e => t.deepEqual(e, ["🙅", "🐞", "❗️"], "returns all errors"))
})

test("search fails once then succeeds, returning data", t => {
  t.plan(3)
  // search -> Er
  //   search -> Ok
  //     res Ok
  const responses = [() => (t.pass("request succeeds eventually"), "✅")]
  const errors = [() => t.pass("request fails once")]
  const search = () => {
    const error = errors.length && errors.pop()()
    return error ? Promise.reject(error) : Promise.resolve(responses.pop()())
  }
  setupRetry(MAX_ATTEMPTS)(search)()
  .then(data => t.equal(data, "✅", "returns data"))
  .catch(t.fail)
})

test("parallel successful searches", t => {
  t.plan(3)
  // search1 -> Ok
  // search2 -> Ok
  //   merge & res [Ok, Ok]
  const responses = [
    () => (t.pass("other request succeeds"), "👍"),
    () => (t.pass("one request succeeds"), "👌"),
  ]
  const search = () => Promise.resolve(responses.pop()())
  mergeSuccesses([search, search].map(setupRetry(MAX_ATTEMPTS)))
  .then(data => t.deepEqual(data, ["👌", "👍"], "returns all data"))
  .catch(t.fail)
})

test("logged in, one of many searches fails auth, relogin retry search", t => {
  t.plan(4)
  // search1 -> Ok
  // search2 -> Er
  //   search2 -> Ok
  //     merge & res [Ok, Ok]
  const responses = [
    () => (t.pass("one request succeeds eventually"), "👍"),
    () => (t.pass("one request succeeds immediately"), "👌"),
  ]
  const errors = [() => t.pass("one request fails once")]
  const search = () => {
    const error = errors.length && errors.pop()()
    return error ? Promise.reject(error) : Promise.resolve(responses.pop()())
  }
  mergeSuccesses([search, search].map(setupRetry(MAX_ATTEMPTS)))
  .then(data => t.deepEqual(data, ["👌", "👍"], "returns all data"))
  .catch(t.fail)
})

test("multiple searches fail, on retry all succeed", t => {
  t.plan(6)
  // search1 -> Ok
  // search2 -> Er
  // search3 -> Er
  //   search2 -> Ok
  //   search3 -> Ok
  //     merge & res [Ok, Ok, Ok]
  const responses = [
    () => (t.pass("two requests succeed eventually"), "👌"),
    () => (t.pass("two requests succeed eventually"), "‍👍"),
    () => (t.pass("one request succeeds immediately"), "✅"),
  ]
  const errors = [
    () => (t.pass("two requests fail once"), "🙅"),
    () => (t.pass("two requests fail once"), "🐞"),
  ]
  const search = () => {
    const error = errors.length && errors.pop()()
    return error ? Promise.reject(error) : Promise.resolve(responses.pop()())
  }
  mergeSuccesses([search, search, search].map(setupRetry(MAX_ATTEMPTS)))
  .then(data => t.deepEqual(data, ["‍👍", "👌", "✅"], "returns all data"))
  .catch(t.fail)
})

test("multiple searches fail, on retry some succeed", t => {
  t.plan(7)
  // search1 -> Ok
  // search2 -> Er
  // search3 -> Er
  //   search2 -> Ok
  //   search3 -> Er
  //     search3 -> Er
  //       merge & res [Ok, Ok, ]
  const responses = [
    () => (t.pass("one requests succeeds after one error"), "‍👍"),
    () => (t.pass("one request succeeds immediately"), "👌"),
  ]
  const errors = [
    () => (t.pass("one requests exhausts attempt 3/3"), "🐞"),
    () => (t.pass("one requests exhausts attempt 2/3"), "🙅"),
    () => (t.pass("one requests exhausts attempt 1/3"), "🐛"),
    () => (t.pass("one request fails once"), "⚠️"),
  ]
  const search = numErrors => {
    const error = 4 - errors.length < numErrors && errors.pop()()
    return error ? Promise.reject(error) : Promise.resolve(responses.pop()())
  }
  mergeSuccesses([
    () => search(0),
    () => search(1),
    () => search(4),
  ].map(setupRetry(MAX_ATTEMPTS)))
  .then(data => t.deepEqual(data, ["👌", "‍👍", ], "returns all data")) // eslint-disable-line
  .catch(t.fail)
})

test("multiple searches fail, none succeeds", t => {
  t.plan(10)
  // search1 -> Er
  // search2 -> Er
  // search3 -> Er
  //   search1 -> Er
  //   search2 -> Er
  //   search3 -> Er
  //     search1 -> Er
  //     search2 -> Er
  //     search3 -> Er
  //      merge & res [Er, Er, Er]
  const errors = [
    () => (t.pass("a request fails"), "🐞"),
    () => (t.pass("a request fails"), "🙅"),
    () => (t.pass("a request fails"), "🐛"),
    () => (t.pass("a request fails"), "⚠️"),
    () => (t.pass("a request fails"), "❗️"),
    () => (t.pass("a request fails"), "🚫"),
    () => (t.pass("a request fails"), "💥"),
    () => (t.pass("a request fails"), "🤢"),
    () => (t.pass("a request fails"), "☠️"),
  ]
  const search = () => Promise.reject(errors.pop()())
  mergeSuccesses([search, search, search].map(setupRetry(MAX_ATTEMPTS)))
  .then(t.fail)
  .catch(error => t.deepEqual(error, [
    ["☠️", "🚫", "🐛"],
    ["🤢", "❗️", "🙅"],
    ["💥", "⚠️", "🐞"]], "returns all errors"))
})

/*
test("logged out, multiple searches", t => {
  t.plan(1)
  // login -> Ok
  //   search1 -> Ok
  //   search2 -> Ok
  //     merge & res [Ok, Ok]
})

test("logged in, search fails auth, relogin retry search", t => {
  // search -> Er
  //   login -> Ok
  //     search -> Ok
  //       res
})

test("logged in, multiple searches fail auth, relogin retry searches", t => {
  // search1 -> Ok
  // search2 -> Er
  // search3 -> Er
  //   login -> Ok
  //     search2 -> Ok
  //     search3 -> Ok
  //       merge & res
})
//*/
