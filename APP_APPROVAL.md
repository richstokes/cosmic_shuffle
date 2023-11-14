> Notes for approval to the spotify "app store"
Submit [via dashboard](https://developer.spotify.com/dashboard/applications/a67c272de308409b84d597b009d5e894)

## App Description
The app uses random noise from the cosmic microwave background to shuffle users playlists in a truly random way.

The app takes the users liked songs (in the future, I may add the ability for users to select a specific playlist) and shuffles them into a new playlist. The app is non-destructive and does not edit the users existing playlists in any way. 

## Link to testable app
https://cosmicshuffle-7yhmv.ondigitalocean.app/


## Scopes
user-read-private 
Needed to get user ID, which is required for creating a new playlist

user-library-read
Needed to get users saved tracks, so they can be shuffled into the new playlist

playlist-read-private
Needed to see if user already has a playlist

playlist-modify-private
Needed to create a new playlist

playlist-modify-public
Needed to create a new public playlist


## Test account
You should be able to log in with your spotify account - I believe they have permissions