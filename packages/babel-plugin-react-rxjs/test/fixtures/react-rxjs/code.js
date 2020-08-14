function abc() {

  for (var i = 0; i < 100; i++) {
    console.log(i);
  }

  return 42;
}

function xyz() {

  for (var i = 0; i < 100; i++) {
    console.log(i);
  }

  if (true) {
    console.log('100');
  }

  otherFunction();

}

function outer() {
  function inner() {
    console.log('does something');
  }

  return inner;
}