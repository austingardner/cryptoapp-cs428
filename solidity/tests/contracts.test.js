require('../scripts/compile');
const assert = require('assert');
const web3 = require('../web3/ganache');

const {
	setMainContract,
	deployShapeFrom,
	getContractForShape,
	isChecksumAddress,
	assertEach,

	RANDOM_FIGHT_COST,
	NOT_ENOUGH_FOR_RANDOM_FIGHT,
} = require('./utils')(web3);

const Main = require('../build/CryptoShapeMain_full.json');
const abi = Main['interface'];
const bytecode = Main['bytecode'];

let accts,
	contract,
	deployer,
	user1,
	user2;

beforeEach(async function() {
		this.timeout(60000);
		// Get list of accts
		accts = await web3.eth.getAccounts();
		deployer = accts[0];
		web3.eth.defaultAccount = deployer;
		user1 = accts[1];
		user2 = accts[2];

		// Use acct to deploy contract
		contract = await new web3.eth.Contract(JSON.parse(abi))
			.deploy({
				data: bytecode
			})
			.send({
				from: deployer,
				gas: '6000000'
			});

		contract.setProvider(web3.currentProvider);

		setMainContract(contract);
});

//======================================================================
//			Test cases

describe("Main contract", () => {
	it("deploys properly", () => {
		assert.ok(contract.options.address);
	});

	it("stores the deployer as the manager field", async () => {
		const manager = await contract.methods.manager().call();

		assert.equal(manager, deployer);
	});

	describe("buyShape()", () => {
		it("should produce a shape for the calling user", async () => {
			const shapeAddr = await deployShapeFrom(user1).andGetAddress();
			const shapeC = getContractForShape(shapeAddr);
			const owner = await shapeC.methods.owner().call();
			assert.equal(owner, user1);
		});
	});

	describe("getShapes()", () => {
		it("returns an empty list of shapes (initially)", async () => {
			const shapes = await contract.methods.getShapes().call();

			assert.deepEqual(shapes, []);
		});
		it("returns the list of shape addresses", async () => {
			const shapeAddr = await deployShapeFrom(user1).andGetAddress();

			const shapes = await contract.methods.getShapes().call();

			assert.equal(shapes.length, 1);
			assert(isChecksumAddress(shapes[0]));
			assert.equal(shapes[0], shapeAddr);
		});
		it("can return multiple addresses", async () => {
			await deployShapeFrom(user1);
			await deployShapeFrom(user1);
			await deployShapeFrom(user2);

			const shapes = await contract.methods.getShapes().call();

			assert.equal(shapes.length, 3);
			assertEach(shapes, isChecksumAddress);
		});
	});

	describe("enterRandomFightPool()", () => {
		let shape1,
			shape2,
			shape1C;
		beforeEach(async () => {
			shape1 = await deployShapeFrom(user1).andGetAddress();
			shape2 = await deployShapeFrom(user2).andGetAddress();
			shape1C = getContractForShape(shape1);
		});
		it("should mark the shape as entered", async () => {
			const entered2 = await shape1C.methods.awaitingRandomFight().call();
			assert(!entered2);
			await contract.methods.enterRandomFightPool(shape1).send({
				value: RANDOM_FIGHT_COST,
				from: user1,
			});
			const entered = await shape1C.methods.awaitingRandomFight().call();
			assert(entered);
		});
		it("should require the user to be the shape owner", async () => {
			// Should fail:
			await contract.methods.enterRandomFightPool(shape1).send({
				value: RANDOM_FIGHT_COST,
				from: user2,
			}).then(assert.fail, assert.ok);
		});
		it("should require the user to pay at least [RANDOM_FIGHT_COST]", async () => {
			// Should fail:
			await contract.methods.enterRandomFightPool(shape1).call({
				value: NOT_ENOUGH_FOR_RANDOM_FIGHT,
				from: user2,
			}).then(assert.fail, assert.ok);
		});
		it("should allow multiple users to enter the random pool", async () => {
			await Promise.all([
				contract.methods.enterRandomFightPool(shape1).send({
					value: RANDOM_FIGHT_COST,
					from: user1,
				}),
				contract.methods.enterRandomFightPool(shape2).send({
					value: RANDOM_FIGHT_COST,
					from: user2,
				})
			]);
		});
		it("should not allow the same shape to enter twice", async () => {
			await contract.methods.enterRandomFightPool(shape1).send({
				value: RANDOM_FIGHT_COST,
				from: user1,
			});
			await contract.methods.enterRandomFightPool(shape1).send({
				value: RANDOM_FIGHT_COST,
				from: user1,
			}).then(
				() => assert.fail("Shape entered multiple times"),
				() => assert.ok("Shape was not allowed to enter multiple times")
			);
		});
	});
}).timeout(20000);
