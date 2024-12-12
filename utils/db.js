import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const db = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${db}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect();
    this.client.on('error', (err) => {
      console.log(err);
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  async getUser(doc) {
    return this.client.db().collection('users').findOne(doc);
  }

  async getUserByEmail(email) {
    return this.client.db().collection('users').findOne({ email });
  }

  async insertUser(doc) {
    const info = await this.client.db().collection('users').insertOne(doc);
    return info;
  }

  async getFile(doc) {
    return this.client.db().collection('files').findOne(doc);
  }

  async getFiles(doc) {
    return this.client.db().collection('files').find(doc);
  }

  async insertFile(doc) {
    const info = await this.client.db().collection('files').insertOne(doc);
    return info;
  }

  async getCollection(col) {
    return this.client.db().collection(col);
  }
}

const dbClient = new DBClient();
export default dbClient;
