import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this._client = createClient();
    this._connected = true;
    this._client.on('error', (err) => {
      this._connected = false;
      console.log(err);
    });
    this._client.on('connect', () => {
      this._connected = true;
    });
  }

  isAlive() {
    return this._connected;
  }

  async get(key) {
    const asyncGet = promisify(this._client.get).bind(this._client);
    return asyncGet(key);
  }

  async set(key, value, exp) {
    await this._client.setex(key, exp, value);
  }

  async del(key) {
    this._client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
