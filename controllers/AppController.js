import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    const response = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    res.status(200);
    res.json(response);
  }

  static getStats(req, res) {
    Promise.all([dbClient.nbUsers(), dbClient.nbFiles()])
      .then(([users, files]) => {
        const response = {
          users,
          files,
        };
        res.status(200);
        res.json(response);
      });
  }
}

export default AppController;
