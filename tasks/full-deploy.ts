import '@nomiclabs/hardhat-ethers';
import { hexlify, keccak256, RLP, defaultAbiCoder } from 'ethers/lib/utils';
import fs from 'fs';
import { task } from 'hardhat/config';
import {
  LensHub__factory,
  ApprovalFollowModule__factory,
  CollectNFT__factory,
  Currency__factory,
  FreeCollectModule__factory,
  FeeCollectModule__factory,
  PrimetimeCollectModule__factory,
  FeeFollowModule__factory,
  FollowerOnlyReferenceModule__factory,
  FollowNFT__factory,
  InteractionLogic__factory,
  LimitedFeeCollectModule__factory,
  LimitedTimedFeeCollectModule__factory,
  ModuleGlobals__factory,
  PublishingLogic__factory,
  RevertCollectModule__factory,
  TimedFeeCollectModule__factory,
  TransparentUpgradeableProxy__factory,
  ProfileTokenURILogic__factory,
  LensPeriphery__factory,
  UIDataProvider__factory,
  ProfileFollowModule__factory,
} from '../typechain-types';
import {
  deployContract,
  ProtocolState,
  waitForTx,
  initEnv,
  getAddrs,
  ZERO_ADDRESS,
} from './helpers/utils';
import { CreateProfileDataStruct } from '../typechain-types/LensHub';
import { PostDataStruct } from '../typechain-types/LensHub';
import {ethers} from "ethers";

const TREASURY_FEE_BPS = 50;
const LENS_HUB_NFT_NAME = 'Lens Protocol Profiles';
const LENS_HUB_NFT_SYMBOL = 'LPP';

task('full-deploy', 'deploys the entire Lens Protocol').setAction(async ({}, hre) => {
  // Note that the use of these signers is a placeholder and is not meant to be used in
  // production.
  const ethers = hre.ethers;
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  const governance = accounts[1];
  const treasuryAddress = accounts[2].address;

  // Nonce management in case of deployment issues
  let deployerNonce = await ethers.provider.getTransactionCount(deployer.address);

  console.log('\n\t -- Deploying Module Globals --');
  const moduleGlobals = await deployContract(
    new ModuleGlobals__factory(deployer).deploy(
      governance.address,
      treasuryAddress,
      TREASURY_FEE_BPS,
      { nonce: deployerNonce++ }
    )
  );

  console.log('\n\t-- Deploying Logic Libs --');

  const publishingLogic = await deployContract(
    new PublishingLogic__factory(deployer).deploy({ nonce: deployerNonce++ })
  );
  const interactionLogic = await deployContract(
    new InteractionLogic__factory(deployer).deploy({ nonce: deployerNonce++ })
  );
  const profileTokenURILogic = await deployContract(
    new ProfileTokenURILogic__factory(deployer).deploy({ nonce: deployerNonce++ })
  );
  const hubLibs = {
    'contracts/libraries/PublishingLogic.sol:PublishingLogic': publishingLogic.address,
    'contracts/libraries/InteractionLogic.sol:InteractionLogic': interactionLogic.address,
    'contracts/libraries/ProfileTokenURILogic.sol:ProfileTokenURILogic':
      profileTokenURILogic.address,
  };

  // Here, we pre-compute the nonces and addresses used to deploy the contracts.
  // const nonce = await deployer.getTransactionCount();
  const followNFTNonce = hexlify(deployerNonce + 1);
  const collectNFTNonce = hexlify(deployerNonce + 2);
  const hubProxyNonce = hexlify(deployerNonce + 3);

  const followNFTImplAddress =
    '0x' + keccak256(RLP.encode([deployer.address, followNFTNonce])).substr(26);
  const collectNFTImplAddress =
    '0x' + keccak256(RLP.encode([deployer.address, collectNFTNonce])).substr(26);
  const hubProxyAddress =
    '0x' + keccak256(RLP.encode([deployer.address, hubProxyNonce])).substr(26);

  // Next, we deploy first the hub implementation, then the followNFT implementation, the collectNFT, and finally the
  // hub proxy with initialization.
  console.log('\n\t-- Deploying Hub Implementation --');

  const lensHubImpl = await deployContract(
    new LensHub__factory(hubLibs, deployer).deploy(followNFTImplAddress, collectNFTImplAddress, {
      nonce: deployerNonce++,
    })
  );

  console.log('\n\t-- Deploying Follow & Collect NFT Implementations --');
  await deployContract(
    new FollowNFT__factory(deployer).deploy(hubProxyAddress, { nonce: deployerNonce++ })
  );
  await deployContract(
    new CollectNFT__factory(deployer).deploy(hubProxyAddress, { nonce: deployerNonce++ })
  );

  const data = lensHubImpl.interface.encodeFunctionData('initialize', [
    LENS_HUB_NFT_NAME,
    LENS_HUB_NFT_SYMBOL,
    governance.address,
  ]);

  console.log('\n\t-- Deploying Hub Proxy --');
  const proxy = await deployContract(
    new TransparentUpgradeableProxy__factory(deployer).deploy(
      lensHubImpl.address,
      deployer.address,
      data,
      { nonce: deployerNonce++ }
    )
  );

  // Connect the hub proxy to the LensHub factory and the governance for ease of use.
  const lensHub = LensHub__factory.connect(proxy.address, governance);

  console.log('\n\t-- Deploying Lens Periphery --');
  const lensPeriphery = await new LensPeriphery__factory(deployer).deploy(lensHub.address, {
    nonce: deployerNonce++,
  });

  // Currency
  console.log('\n\t-- Deploying Currency --');
  const currency = await deployContract(
    new Currency__factory(deployer).deploy({ nonce: deployerNonce++ })
  );

  // Deploy collect modules
  console.log('\n\t-- Deploying feeCollectModule --');
  const feeCollectModule = await deployContract(
    new FeeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying primetimeCollectModule --');
  const primetimeCollectModule = await deployContract(
    new PrimetimeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying limitedFeeCollectModule --');
  const limitedFeeCollectModule = await deployContract(
    new LimitedFeeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying timedFeeCollectModule --');
  const timedFeeCollectModule = await deployContract(
    new TimedFeeCollectModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying limitedTimedFeeCollectModule --');
  const limitedTimedFeeCollectModule = await deployContract(
    new LimitedTimedFeeCollectModule__factory(deployer).deploy(
      lensHub.address,
      moduleGlobals.address,
      { nonce: deployerNonce++ }
    )
  );

  console.log('\n\t-- Deploying revertCollectModule --');
  const revertCollectModule = await deployContract(
    new RevertCollectModule__factory(deployer).deploy({ nonce: deployerNonce++ })
  );
  console.log('\n\t-- Deploying freeCollectModule --');
  const freeCollectModule = await deployContract(
    new FreeCollectModule__factory(deployer).deploy(lensHub.address, { nonce: deployerNonce++ })
  );

  // Deploy follow modules
  console.log('\n\t-- Deploying feeFollowModule --');
  const feeFollowModule = await deployContract(
    new FeeFollowModule__factory(deployer).deploy(lensHub.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying profileFollowModule --');
  const profileFollowModule = await deployContract(
    new ProfileFollowModule__factory(deployer).deploy(lensHub.address, {
      nonce: deployerNonce++,
    })
  );
  // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
  // console.log('\n\t-- Deploying approvalFollowModule --');
  // const approvalFollowModule = await deployContract(
  //   new ApprovalFollowModule__factory(deployer).deploy(lensHub.address, { nonce: deployerNonce++ })
  // );

  // Deploy reference module
  console.log('\n\t-- Deploying followerOnlyReferenceModule --');
  const followerOnlyReferenceModule = await deployContract(
    new FollowerOnlyReferenceModule__factory(deployer).deploy(lensHub.address, {
      nonce: deployerNonce++,
    })
  );

  // Deploy UIDataProvider
  console.log('\n\t-- Deploying UI Data Provider --');
  const uiDataProvider = await deployContract(
    new UIDataProvider__factory(deployer).deploy(lensHub.address, {
      nonce: deployerNonce++,
    })
  );

  // Whitelist the collect modules
  console.log('\n\t-- Whitelisting Collect Modules --');
  let governanceNonce = await ethers.provider.getTransactionCount(governance.address);
  await waitForTx(
    lensHub.whitelistCollectModule(feeCollectModule.address, true, { nonce: governanceNonce++ })
  );
  await waitForTx(
    lensHub.whitelistCollectModule(primetimeCollectModule.address, true, { nonce: governanceNonce++ })
  );
  /*await waitForTx(
    lensHub.whitelistCollectModule(limitedFeeCollectModule.address, true, {
      nonce: governanceNonce++,
    })
  );
  await waitForTx(
    lensHub.whitelistCollectModule(timedFeeCollectModule.address, true, {
      nonce: governanceNonce++,
    })
  );
  await waitForTx(
    lensHub.whitelistCollectModule(limitedTimedFeeCollectModule.address, true, {
      nonce: governanceNonce++,
    })
  );
  await waitForTx(
    lensHub.whitelistCollectModule(revertCollectModule.address, true, { nonce: governanceNonce++ })
  );
  await waitForTx(
    lensHub.whitelistCollectModule(freeCollectModule.address, true, { nonce: governanceNonce++ })
  );*/

  // Whitelist the follow modules
  console.log('\n\t-- Whitelisting Follow Modules --');
  await waitForTx(
    lensHub.whitelistFollowModule(feeFollowModule.address, true, { nonce: governanceNonce++ })
  );
  await waitForTx(
    lensHub.whitelistFollowModule(profileFollowModule.address, true, { nonce: governanceNonce++ })
  );
  // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
  // await waitForTx(
  // lensHub.whitelistFollowModule(approvalFollowModule.address, true, { nonce: governanceNonce++ })
  // );

  // Whitelist the reference module
  console.log('\n\t-- Whitelisting Reference Module --');
  await waitForTx(
    lensHub.whitelistReferenceModule(followerOnlyReferenceModule.address, true, {
      nonce: governanceNonce++,
    })
  );

  // Whitelist the currency
  console.log('\n\t-- Whitelisting Currency in Module Globals --');
  await waitForTx(
    moduleGlobals
      .connect(governance)
      .whitelistCurrency(currency.address, true, { nonce: governanceNonce++ })
  );

  // Save and log the addresses
  const addrs = {
    'lensHub proxy': lensHub.address,
    'lensHub impl:': lensHubImpl.address,
    'publishing logic lib': publishingLogic.address,
    'interaction logic lib': interactionLogic.address,
    'follow NFT impl': followNFTImplAddress,
    'collect NFT impl': collectNFTImplAddress,
    currency: currency.address,
    'lens periphery': lensPeriphery.address,
    'module globals': moduleGlobals.address,
    'fee collect module': feeCollectModule.address,
    'primetime collect module': primetimeCollectModule.address,
    'limited fee collect module': limitedFeeCollectModule.address,
    'timed fee collect module': timedFeeCollectModule.address,
    'limited timed fee collect module': limitedTimedFeeCollectModule.address,
    'revert collect module': revertCollectModule.address,
    'free collect module': freeCollectModule.address,
    'fee follow module': feeFollowModule.address,
    'profile follow module': profileFollowModule.address,
    // --- COMMENTED OUT AS THIS IS NOT A LAUNCH MODULE ---
    // 'approval follow module': approvalFollowModule.address,
    'follower only reference module': followerOnlyReferenceModule.address,
    'UI data provider': uiDataProvider.address,
  };
  const json = JSON.stringify(addrs, null, 2);
  console.log(json);

  fs.writeFileSync('addresses.json', json, 'utf-8');
  fs.writeFileSync('client/src/artifacts/addresses.json', json, 'utf-8');
});

task('unpause', 'unpauses the protocol').setAction(async ({}, hre) => {
  const [governance] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);
  console.log(await lensHub.getState());
  await waitForTx(lensHub.setState(ProtocolState.Unpaused));
  console.log(await lensHub.getState());
});

task('create-profile', 'creates a profile').setAction(async ({}, hre) => {
  const [governance, , user] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);

  await waitForTx(lensHub.whitelistProfileCreator(user.address, true));

  const inputStruct: CreateProfileDataStruct = {
    to: user.address,
    handle: 'zer0dot',
    imageURI:
      'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
    followModule: ZERO_ADDRESS,
    followModuleInitData: [],
    followNFTURI:
      'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
  };
  await waitForTx(lensHub.connect(user).createProfile(inputStruct));

  console.log(`Total supply (should be 1): ${await lensHub.totalSupply()}`);
  console.log(
    `Profile owner: ${await lensHub.ownerOf(1)}, user address (should be the same): ${user.address}`
  );
  console.log(`Profile ID by handle: ${await lensHub.getProfileIdByHandle('zer0dot')}`);
});

task('post', 'publishes a post').setAction(async ({}, hre) => {
  const [governance, , user] = await initEnv(hre);
  const addrs = getAddrs();
  const collectModuleAddr = addrs['fee collect module'];
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], governance);

  //await waitForTx(lensHub.whitelistCollectModule(emptyCollectModuleAddr, true));
  //await waitForTx(lensHub.whitelistCollectModule(freeCollectModuleAddr, true));
  const inputStruct: PostDataStruct = {
    profileId: 1,
    contentURI:
      'https://ipfs.fleek.co/ipfs/plantghostplantghostplantghostplantghostplantghostplantghos',
    collectModule: collectModuleAddr,
    collectModuleInitData: defaultAbiCoder.encode(
      ['uint256', 'address', 'address', 'uint16', 'bool'],
      [1, addrs['currency'], user.address, 0, false]
    ),
    referenceModule: ZERO_ADDRESS,
    referenceModuleInitData: [],
  };

  await waitForTx(lensHub.connect(user).post(inputStruct));
  console.log(await lensHub.getPub(1, 1));
});

task('follow', 'follows a profile').setAction(async ({}, hre) => {
  const [, , user] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], user);

  await waitForTx(lensHub.follow([1], [[]]));

  const followNFTAddr = await lensHub.getFollowNFT(1);
  const followNFT = FollowNFT__factory.connect(followNFTAddr, user);

  const totalSupply = await followNFT.totalSupply();
  const ownerOf = await followNFT.ownerOf(1);

  console.log(`Follow NFT total supply (should be 1): ${totalSupply}`);
  console.log(
    `Follow NFT owner of ID 1: ${ownerOf}, user address (should be the same): ${user.address}`
  );
});

task('collect', 'collects a post').setAction(async ({}, hre) => {
  const [, , user, user2] = await initEnv(hre);
  const addrs = getAddrs();
  const lensHub = LensHub__factory.connect(addrs['lensHub proxy'], user2);
  const currency = Currency__factory.connect(addrs['currency'], user2);

  await waitForTx(currency.approve(addrs['fee collect module'], ethers.constants.MaxUint256));
  console.log('allowence addresses');
  console.log('owner: ', user2.address);
  console.log('spender: ', user.address);
  console.log('currency: ', currency.address);
  await waitForTx(currency.mint(user2.address, 123456));
  console.log('balanceOf owner: ', await currency.balanceOf(user2.address))
  console.log('allowance: ', await currency.allowance(user2.address, user.address));
  await waitForTx(lensHub.collect(1, 1, []));

  const collectNFTAddr = await lensHub.getCollectNFT(1, 1);
  const collectNFT = CollectNFT__factory.connect(collectNFTAddr, user2);

  const publicationContentURI = await lensHub.getContentURI(1, 1);
  const totalSupply = await collectNFT.totalSupply();
  const ownerOf = await collectNFT.ownerOf(1);
  const collectNFTURI = await collectNFT.tokenURI(1);

  console.log(`Collect NFT total supply (should be 1): ${totalSupply}`);
  console.log(
    `Collect NFT owner of ID 1: ${ownerOf}, user address (should be the same): ${user.address}`
  );
  console.log(
    `Collect NFT URI: ${collectNFTURI}, publication content URI (should be the same): ${publicationContentURI}`
  );
});
