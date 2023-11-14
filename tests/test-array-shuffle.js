const shuffleSeed = require('shuffle-seed');

const qrng_url = "https://qrng.anu.edu.au/wp-content/plugins/colours-plugin/get_block_alpha.php"

// Get a random number from the quantum random number generator
async function get_qrng_number() {
    const response = await fetch(qrng_url);
    const data = await response.text();
    return data;
}

async function test_it() {
    test_array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    console.log('Testing array shuffle')
    console.log('Getting seed from quantum random number generator..')
    const seed = await get_qrng_number();
    console.log('Seed: ' + seed)
    console.log('Before: ' + test_array)

    // const seed = 213123122

    var result = shuffleSeed.shuffle(test_array, seed);
    console.log('After: ' + result)

    var result = shuffleSeed.shuffle(test_array, seed);
    console.log('After: ' + result)

    var result = shuffleSeed.shuffle(test_array, seed);
    console.log('After: ' + result)
}

test_it()