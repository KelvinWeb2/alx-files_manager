import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    const headerString = authHeader.split(' ')[1];
    const b64Decode = Buffer.from(headerString, 'base64').toString('utf-8');
    const [email, pwd] = b64Decode.split(':');
    const user = await dbClient.getUserByEmail(email);
    if (user) {
      if (user.password !== sha1(pwd)) {
        res.status(401);
        res.json({ error: 'Unauthorized' });
        return;
      }
    } else {
      res.status(401);
      res.json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    redisClient.set(key, user._id.toString(), 24 * 60 * 60);
    res.json({ token });
  }

  static async getDisconnect(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);

    if (!userId) {
      res.status(401);
      res.json({ error: 'Unauthorized' });
      return;
    }
    redisClient.del(token);
    res.status(204).send();
  }
}

export default AuthController;
