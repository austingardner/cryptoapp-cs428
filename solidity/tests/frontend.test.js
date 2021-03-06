require('../scripts/compile');
const assert = require('assert');
const fetchMock = require('fetch-mock');
const web3 = require('../web3/ganache');

const frontendAPIFactory = require('../facades/frontend');

const Main = require('../build/CryptoShapeMain_full.json');
const abi = Main['interface'];
const bytecode = Main['bytecode'];

var accts,
	mainContract,
	frontendAPI,
	deployer,
	user,
	otherUser;

beforeEach(async () => {
		global.fetch = fetchMock.sandbox();
		fetch.post('/validateEvent', function(__url, __req) {
			return JSON.stringify({ valid: true });
		});

		// Get list of accts
		accts = await web3.eth.getAccounts();

		user = accts[0];
		deployer = accts[1];
		otherUser = accts[2];

		var sendOpts = {
			from: deployer,
			gas: '6000000'
		};

		// Use acct to deploy mainContract
		mainContract = await new web3.eth.Contract(JSON.parse(abi))
			.deploy({
				data: bytecode
			})
			.send(sendOpts);

		frontendAPI = frontendAPIFactory(web3, mainContract.options.address);
});

describe("Frontend Solidity API", () => {
	describe("getUserAccount()", () => {
		it("should return the user account address", async () => {
			const addr = await frontendAPI.getUserAccount();
			assert.equal(addr, user);
		});
	});

	describe("buyShape()", () => {
		it("should return a valid address", async () => {
			var addr = await frontendAPI.buyShape();
			assert(web3.utils.isAddress(addr));
		});
	});

	describe("personalSign(...)", () => {
		it("should... do something...", done => {
			frontendAPI.personalSign("Potato", accts[1], function(err, data) {
				// personal_sign isn't actually supported by ganace, so this is the best we can do.
				done();
			});
		});
	});

	describe("private utilities", () => {
		describe("_eventToJson()", () => {
			it("should have the right structure", async () => {
				var json = frontendAPI._eventToJson({
					event: "TwoFoods",
					returnValues: {
						"0": "Potato",
						"1": "Bagel",
						"potato": "Potato",
						"bagel": "Bagel",
					}
				});
				assert.deepEqual(json, {
					type: "TwoFoods",
					values: [ "Potato", "Bagel" ],
				});
			});
		});
	});
});

//======================================================================
//			Utility functions

function deployShapeFrom(acct) {
	return mainContract.methods.buyShape().send({
		from: acct,
		value: web3.utils.toWei('0.01', 'ether'),
		gas: '3000000'
	});
}
