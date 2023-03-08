interface User {
  _id: ObjectId;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  ip: string;
}