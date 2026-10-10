function createShuffledArray(start, end) {
  const length = end - start;

  const array = Array.from({ length }, (_, i) => i + start);

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function sleepSort(theArray) {
  for (let i = 0; i < theArray.length; i++) {
    setTimeout(() => console.log(theArray[i]), theArray[i]);
  }
}

if (require.main === module) {
  const [end] = process.argv.slice(2);
  sleepSort([1, ...createShuffledArray(3, end), 2]);
}
