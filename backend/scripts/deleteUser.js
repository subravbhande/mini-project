require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const CropBatch = require('../src/models/CropBatch');
const Decision = require('../src/models/Decision');

async function main() {
  const phone = process.argv[2]?.trim();

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  if (!phone) {
    // List all users
    const users = await User.find({}).select('phone name district isVerified createdAt');
    console.log(`Found ${users.length} registered users:`);
    console.table(
      users.map((u) => ({
        ID: String(u._id),
        Phone: u.phone,
        Name: u.name,
        District: u.district,
        Verified: u.isVerified,
        Created: u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A',
      }))
    );
    console.log('\nTo delete a specific user, run:');
    console.log('node scripts/deleteUser.js <10-digit-phone-number>\n');
    await mongoose.disconnect();
    return;
  }

  // Delete specific user
  const user = await User.findOne({ phone });
  if (!user) {
    console.log(`User with phone ${phone} not found in database.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found user: ${user.name} (${user.phone}) [ID: ${user._id}]`);

  // Delete user's decisions and batches
  const batchDeleteResult = await CropBatch.deleteMany({ userId: user._id });
  const decisionDeleteResult = await Decision.deleteMany({ userId: user._id });
  const userDeleteResult = await User.deleteOne({ _id: user._id });

  console.log(`Successfully deleted:`);
  console.log(`- User: ${userDeleteResult.deletedCount} record`);
  console.log(`- Crop Batches: ${batchDeleteResult.deletedCount} records`);
  console.log(`- Decision Records: ${decisionDeleteResult.deletedCount} records`);
  console.log(`\nPhone number ${phone} is now completely freed up for fresh registration.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
