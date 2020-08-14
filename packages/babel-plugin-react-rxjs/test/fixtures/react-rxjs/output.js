
function abc() {
  console.time("abc")

  for (var i = 0; i < 100; i++) {
    console.log(i)
  }

  console.timeEnd("abc")
  return 42
}

function xyz() {
  console.time("xyz")

  for (var i = 0; i < 100; i++) {
    console.log(i)
  }

  if (true) {
    console.log("100")
  }

  otherFunction()
  console.timeEnd("xyz")
}

function outer() {
  console.time("outer")

  function inner() {
    console.time("inner")
    console.log("does something")
    console.timeEnd("inner")
  }

  console.timeEnd("outer")
  return inner
}