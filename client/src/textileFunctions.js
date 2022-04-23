import {Buckets} from '@textile/hub'
import {Buffer} from 'buffer'

const keyInfo = {
    key: process.env.REACT_APP_KEY_TEXTILEBUCKETS,
    secret: process.env.REACT_APP_SECRET_TEXTILEBUCKETS
}

async function getBucketClient() {
    const buckets = await Buckets.withKeyInfo(keyInfo)
    return buckets;
}

async function getOrCreateBucket(buckets, bucketName) {
    const {root,} = await buckets.getOrCreate(bucketName)
    if (!root) throw new Error('bucket not created')
    const bucketKey = root.key
    return bucketKey;
}

export async function pushTextToIpfs(text) {
    const bucketsX = await getBucketClient();
    //console.log(bucketsX);
    let bucketKeyX = await getOrCreateBucket(bucketsX, 'testbucket');
    //console.log(bucketKeyX);
    const fileX = {
        path: '/index.html',
        //content: text//new Uint8Array(Buffer.from(text))
        content: await new Response(new Blob([text])).arrayBuffer()
    }
    //console.log(fileX);
    const links = await bucketsX.pushPath(bucketKeyX, 'text.txt', fileX)//, { root })
    console.log(`https://hub.textile.io${links.path.path}`);
    return links.path.path;
}

