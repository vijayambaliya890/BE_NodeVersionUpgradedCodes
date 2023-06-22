// STATUS CHANGE SCRIPT

const { MongoClient,ObjectId } = require('mongodb');

const url = 'mongodb://polaris:ZxfwgjF7vakU3ybR@ec2-54-255-149-25.ap-southeast-1.compute.amazonaws.com:27017/flexishiftdb?authSource=flexishiftdb ';
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

MongoClient.connect(url, options, (error, client) => {
  if (error) {
    console.error('Failed to connect to MongoDB:', error);
    return;
  }

  const db = client.db('flexishiftdb');
  const collection = db.collection('challengestatuses');

  const filter = { status: false , challengeId:ObjectId('5d6cfa66746c2251409bcc64')};
  const update = { $set: { status: true } };

  collection.updateMany(filter, update, (error, result) => {
    if (error) {
      console.error('Failed to update documents:', error);
      return;
    }

    console.log('Documents updated successfully:', result.modifiedCount);
    client.close();
  });
});
