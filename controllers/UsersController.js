import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    // const { email, password } = req.body ? req.body : {'email': null, 'password': null}
    const email = req.body ? req.body.email : null;
    const password = req.body ? req.body.password : null;

    if (!email) {
      res.status(400);
      res.json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400);
      res.json({ error: 'Missing password' });
      return;
    }

    const user = await dbClient.getUserByEmail(email);
    if (user) {
      res.status(400);
      res.json({ error: 'Already exist' });
      return;
    }

    const hashedPwd = sha1(password);

    const info = await dbClient.insertUser({ email, password: hashedPwd });
    res.status(201);
    res.json({ id: info.insertedId, email });
  }

  static async getMe(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);

    if (!userId) {
      res.status(401);
      res.json({ error: 'Unauthorized' });
      return;
    }

    const user = await dbClient.getUser({ _id: ObjectId(userId) });
    if (!user) {
      res.status(401);
      res.json({ error: 'Unauthorized' });
      return;
    }
    res.json({ id: user._id, email: user.email });
  }
}

export default UsersController;
