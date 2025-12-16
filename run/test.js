const q = makeRateLimitedQ(3000);
const f = () => console.log(1);
q.schedule(f);
q.schedule(f);
q.stop();

// ---

// scheduled: 0
// fired: 0

// ---

// scheduled: 0
// scheduled: 0
// fired: 2
// fired: 3

// ---

// scheduled: 0
// scheduled: 0
// fired: 3
// fired: 3

// ---

// scheduled: 0
// scheduled: 10
// scheduled: 11
// fired: 0
// fired: 10
// fired: 13

// ---


function makeRateLimitedQ(timeToWaitMs) {
	let q = [];
	let timer = null;
	let flushing = false;

	const flush = () => {
		if (!q.length) {
			flushing = false;
			timer = null;
		}

		const cb = q.shift();
		cb();
		flushing = true;

		timer = setTimeout(() => {
			if (!q.length) {
				flushing = false;
				return;
			}
			flush();
		}, timeToWaitMs);
	}

	return {
		schedule: (callback) => {
			q.push(callback);

			if (!flushing) {
				flush();
			}
		},
		stop: () => {
			q = [];
			timer && clearTimeout(timer);
			timer = null;
		}
	}
}
