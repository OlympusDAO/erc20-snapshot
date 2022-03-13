import BigNumber from "bignumber.js";
import enumerable from "linq";

export const createBalances = async eventData => {
	// Map object which will contain the total in withdrawals and deposits made by each address
	const balances = new Map();
	// Array to store the final balance of each address
	const closingBalances = [];

	const setDeposits = event => {
		const wallet = event.to;

		let deposits = (balances.get(wallet) || {}).deposits || new BigNumber(0);
		let withdrawals = (balances.get(wallet) || {}).withdrawals || new BigNumber(0);

		if (event.value) {
			// Increment the value of deposits for this address
			deposits = deposits.plus(new BigNumber(event.value));
			balances.set(wallet, { deposits, withdrawals });
		}
	};

	const setWithdrawals = event => {
		const wallet = event.from;

		let deposits = (balances.get(wallet) || {}).deposits || new BigNumber(0);
		let withdrawals = (balances.get(wallet) || {}).withdrawals || new BigNumber(0);

		if (event.value) {
			// Increment the value of withdrawals for this address
			withdrawals = withdrawals.plus(new BigNumber(event.value));
			balances.set(wallet, { deposits, withdrawals });
		}
	};

	// Iterate through all the events and store, for each address, the total in withdrawals and deposits, respectively,
	// in the Map object `balances`
	for (const event of eventData.events) {
		setDeposits(event);
		setWithdrawals(event);
	}

	for (const [key, value] of balances.entries()) {
		if (key === "0x0000000000000000000000000000000000000000") {
			continue;
		}

		// Subtract total withdrawals from total deposits to get the final balance for each address
		const balance = value.deposits.minus(value.withdrawals);

		closingBalances.push({
			wallet: key,
			balance: balance.div(10 ** parseInt(eventData.decimals)).toFixed(parseInt(eventData.decimals))
		});
	}

	// Final balances are returned in order highest to lowest
	return enumerable
		.from(closingBalances)
		.orderByDescending(x => parseFloat(x.balance))
		.toArray();
};