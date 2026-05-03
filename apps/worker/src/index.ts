import cron from 'node-cron';

console.log('Worker started. Scheduling jobs...');

cron.schedule('0 * * * *', () => {
    console.log('Running expire_topups job');
});

// more jobs to be added
