import mongoose, { ConnectOptions } from 'mongoose';

export interface MongoConfig {
  uri: string;
  dbName?: string;
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
}

const DEFAULT_CONFIG: MongoConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/talentpulse_docs',
  dbName: process.env.MONGODB_DB_NAME || 'talentpulse_docs',
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
};

export class MongoDatabase {
  private static instance: MongoDatabase;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoDatabase {
    if (!MongoDatabase.instance) {
      MongoDatabase.instance = new MongoDatabase();
    }
    return MongoDatabase.instance;
  }

  public async connect(config: MongoConfig = DEFAULT_CONFIG): Promise<typeof mongoose> {
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose;
    }

    try {
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        console.log('[MongoDatabase] Connected to MongoDB Atlas successfully.');
      });

      mongoose.connection.on('error', (err: any) => {
        console.error('[MongoDatabase] Connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDatabase] Disconnected from MongoDB Atlas.');
        this.isConnected = false;
      });

      const connectOptions: ConnectOptions = {};
      if (config.dbName) connectOptions.dbName = config.dbName;
      if (config.maxPoolSize) connectOptions.maxPoolSize = config.maxPoolSize;
      if (config.serverSelectionTimeoutMS) connectOptions.serverSelectionTimeoutMS = config.serverSelectionTimeoutMS;

      const connection = await mongoose.connect(config.uri, connectOptions);

      this.isConnected = true;
      return connection;
    } catch (error) {
      console.error('[MongoDatabase] Failed to establish MongoDB connection:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('[MongoDatabase] Disconnected cleanly.');
    }
  }
}

export const mongoDb = MongoDatabase.getInstance();
