import { ObjectId } from 'mongodb';
import { join } from 'path';
import fs, { statSync, existsSync, realpathSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { contentType } from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FilesController = {
  async postUpload(req, res) {
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

    const name = req.body ? req.body.name : null;
    const type = req.body ? req.body.type : null;
    let parentId = req.body ? req.body.parentId : null;
    if (!parentId) {
      parentId = '0';
    }
    let isPublic = req.body ? req.body.isPublic : null;
    if (!isPublic) {
      isPublic = false;
    }
    const data = req.body ? req.body.data : null;

    if (!name) {
      res.status(400);
      res.json({ error: 'Missing name' });
      return;
    } const TypeList = ['folder', 'file', 'image'];
    if (!type || (!TypeList.includes(type))) {
      res.status(400);
      res.json({ error: 'Missing type' });
      return;
    }

    if (!data && type !== 'folder') {
      res.status(400);
      res.json({ error: 'Missing data' });
      return;
    }

    if (parentId !== '0') {
      parentId = ObjectId(parentId);
      const parentFile = await dbClient.getFile({ _id: parentId });
      if (!parentFile) {
        res.status(400);
        res.json({ error: 'Parent not found' });
        return;
      }
      if (parentFile.type !== 'folder') {
        res.status(400);
        res.json({ error: 'Parent is not a folder' });
        return;
      }
    }
    if (type === 'folder') {
      const doc = {
        userId: user._id, name, type, parentId,
      };
      const insertInfo = await dbClient.insertFile(doc); res.status(201); res.json({
        id: insertInfo.insertedId, userId: user._id, name, type, isPublic, parentId,
      });
      return;
    }
    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manenger'; fs.mkdir(FOLDER_PATH, { recursive: true }, (err) => {
      if (err) { console.log(err); }
      const filePath = join(FOLDER_PATH, uuidv4());
      fs.writeFile(filePath, Buffer.from(data, 'base64'), 'utf-8', async (err) => {
        if (err) {
          console.log(err);
        }
        const doc = {
          userId: user._id, name, type, isPublic, parentId, localpath: filePath,
        };
        const insertInfo = await dbClient.insertFile(doc); res.status(201);
        res.json({
          id: insertInfo.insertedId,
          userId: user._id,
          name,
          type,
          parentId,
          isPublic,
          localpath: filePath,
        });
      });
    });
  },

  async getShow(req, res) {
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

    const fileId = req.params ? req.params.id : null;
    const file = await dbClient.getFile({ userId: user._id, _id: ObjectId(fileId) });
    if (!file) {
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }
    const doc = {
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    };
    /* file.localpath = undefined
    file.id = file._id
    file._id = undefined */

    res.json(doc);
  },

  async getIndex(req, res) {
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

    let parentId = req.query ? req.query.parentId : null;
    let page = req.query ? req.query.page : null;
    page = Number.parseInt(page, 10);
    if (Number.isNaN(page)) {
      page = 0;
    }
    if (!parentId) {
      parentId = '0';
    } else {
      parentId = ObjectId(parentId);
    }
    const filter = { userId: user._id, parentId };

    const filesCollection = await dbClient.getCollection('files');
    const files = await filesCollection.aggregate([
      { $match: filter },
      { $sort: { _id: -1 } },
      { $skip: page * 20 },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          id: '$_id',
          userId: '$userId',
          name: '$name',
          type: '$type',
          isPublic: '$isPublic',
          parentId: '$parentId',
        },
      },
    ]).toArray();
    res.status(200).json(files);
  },

  async putPublish(req, res) {
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

    const fileId = req.params ? req.params.id : null;

    const file = await dbClient.getFile({ _id: ObjectId(fileId), userId: user._id });
    if (!file) {
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }

    const filesCollection = await dbClient.getCollection('files');

    const filter = { _id: ObjectId(fileId), userId: user._id };
    const operation = { $set: { isPublic: true } };
    await filesCollection.updateOne(filter, operation);
    const updatedFile = await filesCollection.findOne(filter);
    updatedFile.localpath = undefined;
    updatedFile.id = updatedFile._id;
    updatedFile._id = undefined;
    res.status(200).json(updatedFile);
  },

  async putUnpublish(req, res) {
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

    const fileId = req.params ? req.params.id : null;

    const file = await dbClient.getFile({ _id: ObjectId(fileId), userId: user._id });
    if (!file) {
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }

    const filesCollection = await dbClient.getCollection('files');

    const filter = { _id: ObjectId(fileId), userId: user._id };
    const operation = { $set: { isPublic: false } };
    await filesCollection.updateOne(filter, operation);
    const updatedFile = await filesCollection.findOne(filter);
    updatedFile.localpath = undefined;
    updatedFile.id = updatedFile._id;
    updatedFile._id = undefined;
    res.status(200).json(updatedFile);
  },

  async getFile(req, res) {
    const token = `auth_${req.headers['x-token']}`;
    const userId = await redisClient.get(token);

    const { id } = req.params;
    const file = await dbClient.getFile({ _id: ObjectId(id) });
    if (!file) {
      console.log(1);
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }

    if (!file.isPublic && file.userId.toString() !== userId) {
      console.log(2);
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }

    if (file.type === 'folder') {
      res.status(400);
      res.json({ error: "A folder doesn't have content" });
      return;
    }

    if (existsSync(file.localpath)) {
      const stats = statSync(file.localpath);
      if (!stats.isFile()) {
        console.log(3);
        res.status(404);
        res.json({ error: 'Not found' });
        return;
      }
    } else {
      console.log(4);
      res.status(404);
      res.json({ error: 'Not found' });
      return;
    }

    const fullPath = realpathSync(file.localpath);
    res.setHeader('Content-Type', contentType(file.name || 'text/plain; charset=utf-8'));
    res.sendFile(fullPath);
  },

};

export default FilesController;
