import { readFile } from 'fs/promises'
import 'dotenv/config'
import mongoose from 'mongoose'
import { User, UserProfile, DailyCheck } from '@shelter-zone/sz-data-models'

// Deta types
import type { SZUser as DetaSZUser } from '@shelter-zone/sz-api-types/SZUser'
import type { SZUserProfile as DetaSZUserProfile } from '@shelter-zone/sz-api-types/SZUserProfile'

// Mongodb types
import type { SZUser, SZUserProfile, SZDailyCheckRecord } from '@shelter-zone/sz-api-types/v2'

const saveUser = async() => {
  const timeStart = Date.now()

  const [ detaUserRecords, mdbUserRecord ] = await Promise.all([
    readFile('data/user.json', 'utf8').then((data) => JSON.parse(data) as DetaSZUser[]),
    User.find()
  ])

  const dataPut: Omit<SZUser, 'createAt' | 'id' | 'updateAt'>[] = []
  const queueUpdate = []
  for (const detaUser of detaUserRecords) {
    const mdbUser = mdbUserRecord.find((mdbUser) => mdbUser.userId === detaUser.id)
    if (mdbUser) {
      queueUpdate.push(User.updateOne({ userId: detaUser.id }, { type: detaUser.type }))
    }
    else {
      dataPut.push({ userId: detaUser.id, type: detaUser.type })
    }
  }
  await Promise.allSettled([ User.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.user] Put ${dataPut.length}, Update ${queueUpdate.length} items in ${Date.now() - timeStart}ms`)
}

const saveDailyCheck = async() => {
  const timeStart = Date.now()

  const [ detaDailyCheckRecords, mdbDailyCheckRecords ] = await Promise.all([
    readFile('data/dailyCheck.json', 'utf8').then((data) => (JSON.parse(data) as DetaSZDailyCheckGuild)[1].members),
    DailyCheck.find()
  ])

  const dataPut: (Omit<SZDailyCheckRecord, 'id' | 'lastRecord'> & { lastRecord: string })[] = []
  const queueUpdate = []
  for (const detaDailyCheck of detaDailyCheckRecords) {
    const mdbDailyCheck = mdbDailyCheckRecords.find((mdbDailyCheck) => mdbDailyCheck.userId === detaDailyCheck.memberID)
    if (mdbDailyCheck) {
      queueUpdate.push(DailyCheck.updateOne({ userId: detaDailyCheck.memberID }, { lastRecord: detaDailyCheck.lastCheck }))
    }
    else {
      dataPut.push({ userId: detaDailyCheck.memberID, lastRecord: detaDailyCheck.lastCheck })
    }
  }
  await Promise.allSettled([ DailyCheck.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.dailyCheck] Put ${dataPut.length}, Update ${queueUpdate.length} items in ${Date.now() - timeStart}ms`)
}

const saveUserProfile = async() => {
  const timeStart = Date.now()

  const [ detaUserProfileRecords, mdbUserRecords, mdbUserProfileRecords ] = await Promise.all([
    readFile('data/userProfile.json', 'utf8').then((data) => JSON.parse(data) as DetaSZUserProfile[]),
    User.find(),
    UserProfile.find()
  ])

  const dataPut: (Omit<SZUserProfile, 'createAt' | 'id' | 'updateAt' | 'user'> & { user: QueryType<ReturnType<typeof User.findOne>> | null })[] = []
  const queueUpdate = []
  for (const detaUserProfile of detaUserProfileRecords) {
    const mdbSZUser = mdbUserRecords.find((mdbUser) => mdbUser.userId === detaUserProfile.userId)

    if (mdbUserProfileRecords.find((mdbUserProfile) => mdbUserProfile.user.toString() === mdbSZUser?.id)) {
      queueUpdate.push(UserProfile.updateOne({ user: mdbSZUser }, { name: detaUserProfile.name, rep: detaUserProfile.rep }))
    }
    else {
      dataPut.push({ user: mdbSZUser ?? null, name: detaUserProfile.name, rep: detaUserProfile.rep })
    }
  }
  await Promise.allSettled([ UserProfile.insertMany(dataPut), ...queueUpdate ])

  console.log(`[${mongoose.connection.name}.userProfile] Put ${dataPut.length}, Update ${queueUpdate.length} items in ${Date.now() - timeStart}ms`)
}

const updateUser = async() => {
  const timeStart = Date.now()

  const [ mdbUserRecords, mdbUserProfileRecords ] = await Promise.all([
    User.find(),
    UserProfile.find()
  ])

  const queueUpdate = []
  for (const mdbUserProfile of mdbUserProfileRecords) {
    const mdbSZUser = mdbUserRecords.find((mdbUser) => mdbUser.id === mdbUserProfile.user.toString())
    if (!mdbSZUser) continue

    mdbSZUser.profiles = { userProfile: mdbUserProfile.id }
    queueUpdate.push(mdbSZUser.save())
  }

  await Promise.allSettled(queueUpdate)

  console.log(`[${mongoose.connection.name}.user] Update ${queueUpdate.length} items reference in ${Date.now() - timeStart}ms`)
}

const saveMongoDB = async() => {
  if (!process.env.MONGODB_URI) {
    console.log('No MongoDB URI found')
    return
  }

  await mongoose.connect(process.env.MONGODB_URI)

  const timeStart = Date.now()
  await Promise.allSettled([
    saveUser(),
    saveDailyCheck()
  ])
  await saveUserProfile()
  await updateUser()
  console.log(`All data save complete in ${Date.now() - timeStart}ms`)
}

saveMongoDB().then(() => mongoose.disconnect())