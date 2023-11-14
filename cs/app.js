/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var shuffleSeed = require('shuffle-seed');
const qrng_url = "https://qrng.anu.edu.au/wp-content/plugins/colours-plugin/get_block_alpha.php"

if (!process.env.CS_CLIENT_ID || !process.env.CS_CLIENT_SECRET) {
  console.log('Missing environment variables. Please set CS_CLIENT_ID and CS_CLIENT_SECRET.');
  process.exit(1);
}

var client_id = process.env.CS_CLIENT_ID;
var client_secret = process.env.CS_CLIENT_SECRET;

// set redirect_uri based on wether running in production or locally
if (process.env.CS_ENV === 'local') {
  console.log('Running in local environment. Setting redirect_uri to http://localhost:8888/callback');
  var redirect_uri = 'http://localhost:8888/callback';
} else {
  console.log('Running in production environment. Setting redirect_uri to https://cosmicshuffle.app/callback');
  var redirect_uri = 'https://cosmicshuffle.app/callback';
}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Get a random number from the quantum random number generator
async function get_qrng_number() {
  const response = await fetch(qrng_url);

  if (!response.ok) {
    console.error(`HTTP error while quering QRNG! status: ${response.status}. Failing back to Math.random()`);
    return Math.random().toString();
  } else {
    const data = await response.text();
    return data;
  }
}

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-library-read, playlist-read-private, playlist-modify-private, playlist-modify-public';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    // Get access and refresh tokens
    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, async function (error, response, body) {
          // console.log(body);
          if (!error && response.statusCode === 200) {
            console.log(body.id + ' logged in as: ' + body.display_name);
          } // end of if logged in OK
        });

        // send the playlists to the client
        // res.send(playlists);

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });

  }
});

app.get('/refresh_token', function (req, res) {

  console.log('refreshing token');
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

// Function to shuffle an array
// async function shuffleArray(array) {
//   for (var i = array.length - 1; i > 0; i--) {

//     // Generate random number
//     var j = Math.floor(Math.random() * (i + 1));

//     var temp = array[i];
//     array[i] = array[j];
//     array[j] = temp;
//   }

//   return array;
// }


app.get('/shuffle_liked', async function (req, res) {

  // console.log('Shuffling liked songs');
  let track_ids = [];

  // Get access token from browser query string
  var access_token = req.query.access_token;
  var playlist_id = req.query.playlist_id;
  var playlist_name = req.query.playlist_name;

  // Check we have an access token
  if (!access_token) {
    console.error('No access token');
    return;
  }

  if (!playlist_id) {
    console.error('No playlist ID provided');
    return;
  }

  // Load Liked Songs
  const savedSongs = await loadSaveditems(access_token, playlist_name, playlist_id);

  if (!savedSongs) {
    console.error('No Liked Songs returned');
    // Send error to browser
    res.send({
      'playlist_status': 'error'
    });

    return;
  }

  for (var i = 0; i < savedSongs.length; i++) {
    var track = savedSongs[i].track;
    // console.log('ID: ' + track['id'] + ' / ' + track['name'] + ' / ' + track['artists'][0]['name']);
    track_ids.push(track['id']);
  }

  // console.log('track_ids length: ' + track_ids.length);

  // Shuffle track_ids
  seed = await get_qrng_number();
  console.log('seed: ' + seed.slice(0, 10));
  track_ids = shuffleSeed.shuffle(track_ids, seed);

  // Create new playlist
  const playlist_url = await createPlaylist(track_ids, access_token, playlist_name);

  // Send response to browser
  res.send({
    'playlist_status': track_ids.length,
    'playlist_url': playlist_url
  });

});

async function createPlaylist(track_ids, access_token, playlist_name) {
  const user_data = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
  const data = await user_data.json();
  const user_id = data.id;

  console.log(user_id + ' Creating new playlist..')

  // Delete playlist if it already exists
  const playlists = await fetch('https://api.spotify.com/v1/me/playlists', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  const playlists_data = await playlists.json();
  for (var i = 0; i < playlists_data.items.length; i++) {
    var playlist = playlists_data.items[i];
    if (playlist.name == 'Cosmic Shuffled Songs') {
      console.log(user_id + ' Deleting existing playlist: ' + playlist.name);
      const delete_playlist = await fetch('https://api.spotify.com/v1/playlists/' + playlist.id + '/followers', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
    }
  }


  // Now create the playlist
  // Create the playlist
  let endpoint = 'https://api.spotify.com/v1/users/' + user_id + '/playlists';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      name: 'Cosmic Shuffled Songs',
      description: 'Shuffled songs from via cosmicshuffle.app (original playlist: ' + playlist_name + ')',
      public: false,
    }),
  });

  if (!response.ok) {
    console.warning('Error in response when creating playlist: ' + response.status + ' ' + response.statusText)
    console.warning('Continuing..')
  }

  // And add the tracks to the playlist
  const playlist_data = await response.json();
  const playlist_id = playlist_data.id;
  const playlist_url = playlist_data.external_urls.spotify;
  // console.log(user_id + ' playlist_id: ' + playlist_id);
  console.log(user_id + ' playlist_url: ' + playlist_url);

  endpoint = 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks';
  const chunkSize = 100; // Spotify API limit

  console.log(user_id + ' Adding tracks to playlist..')
  for (let i = 0; i < track_ids.length; i += chunkSize) {
    const chunk = track_ids.slice(i, i + chunkSize);
    // console.log('chunk length: ' + chunk.length);
    // console.log('Adding chunk: ' + chunk);

    const response2 = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        uris: chunk.map(id => `spotify:track:${id}`),
      }),
    });

    if (!response2.ok) {
      console.log('Error in response when adding tracks to playlist: ' + response.status + ' ' + response.statusText)
    }
  }

  // Change playlist to private
  // endpoint = 'https://api.spotify.com/v1/playlists/' + playlist_id;
  // const response3 = await fetch(endpoint, {
  //   method: 'PUT',
  //   headers: {
  //     Authorization: `Bearer ${access_token}`,
  //   },
  //   body: JSON.stringify({
  //     "public": false,
  //   }),
  // });
  // if (!response3.ok) {
  //   console.log('Error in response: ' + response.status + ' ' + response.statusText)
  //   console.log(response3)
  // } else {
  //   console.log(user_id + ' Playlist set to private');
  //   console.log(response3)
  // }


  console.log(user_id + ' Playlist created successfully!');
  return playlist_url;
}

async function loadSaveditems(access_token, playlist_name, playlist_id) {
  const user_data = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
  const data = await user_data.json();
  const user_id = data.id;

  let items = [];

  if (playlist_name.includes("Liked Songs")) {
    var endpoint = 'https://api.spotify.com/v1/me/tracks?offset=0&limit=50';
  } else {
    var endpoint = 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks';
  }

  console.log(user_id + ' Paging through liked songs for playlist: ' + playlist_name + ' playlist_id: ' + playlist_id);
  while (endpoint) {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!response.ok) {
      console.log('Error in response while trying to fetch tracks page: ' + response.status + ' ' + response.statusText);
      return null;
    }

    const page = await response.json();
    // console.log(page.items) // Uncomment to log the data structure
    items = items.concat(page.items);
    // console.log(user_id + ' loaded playlist items: ' + items.length);
    endpoint = page.next;
  }

  console.log(user_id + ' Done paging through ' + items.length + ' liked songs');
  return items;
}

console.log('Listening on 8888');
app.listen(8888);
