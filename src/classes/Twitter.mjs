import Twitter from 'twitter'
import config from '../config'

const twitter = new Twitter({
  consumer_key: config.twitter.consumerKey,
  consumer_secret: config.twitter.consumerSecret,
  access_token_key: config.twitter.token,
  access_token_secret: config.twitter.tokenSecret,
})

export default twitter
