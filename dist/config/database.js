"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const { MONGO_URI } = process.env;
// Conection Settings
const conectionSettings = {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
    useUnifiedTopology: true,
};
// conection with mongo
const connection = () => {
    mongoose_1.default.connect(MONGO_URI, conectionSettings)
        .then(() => console.log('Conected to MongoDB'))
        .catch((err) => {
        // if error log error & exit
        console.log('Error conecting to MongoDB:');
        console.error(err);
        console.log("Exiting Database...");
        // exit process
        process.exit(1);
    });
};
exports.default = connection;
