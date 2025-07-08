import cron from 'node-cron';
import { Provider } from '../models/Provider.js';

export const startAvailabilityScheduler = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('Running availability check for providers...');
        try {
            const providers = await Provider.find({});

            const currentDate = new Date();
            const currentDay = currentDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            const currentHour = currentDate.getHours();
            const currentMinute = currentDate.getMinutes();

            for (const provider of providers) {
                const workingHours = provider.workingHours?.[currentDay];

                let shouldBeAvailable = false;

                if (workingHours?.available) {
                    const [startHour, startMinute] = workingHours.start.split(":").map(Number);
                    const [endHour, endMinute] = workingHours.end.split(":").map(Number);

                    // Create Date objects for comparison
                    const startTime = new Date(currentDate);
                    startTime.setHours(startHour, startMinute, 0, 0);

                    const endTime = new Date(currentDate);
                    endTime.setHours(endHour, endMinute, 0, 0);

                    // Check if current time is within working hours
                    if (currentDate >= startTime && currentDate <= endTime) {
                        shouldBeAvailable = true;
                    }
                }

                // If the calculated availability differs from the current stored availability, update it
                if (provider.isAvailable !== shouldBeAvailable) {
                    await Provider.findByIdAndUpdate(
                        provider._id,
                        { isAvailable: shouldBeAvailable },
                        { new: true } // Return the updated document
                    );
                    console.log(`Provider ${provider.email} availability updated to: ${shouldBeAvailable}`);
                }
            }
            console.log('Availability check completed.');
        } catch (error) {
            console.error('Error during availability check:', error);
        }
    });

    // You might also want a task that runs at midnight to reset availability for the new day
    cron.schedule('0 0 * * *', async () => { // Runs at midnight (00:00) every day
        console.log('Running daily availability reset...');
        try {
            const providers = await Provider.find({});
            for (const provider of providers) {
                const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
                const workingHours = provider.workingHours?.[currentDay];

                // If today is not available in their working hours or it's a new day and they were available
                if (!workingHours?.available && provider.isAvailable) {
                     await Provider.findByIdAndUpdate(
                        provider._id,
                        { isAvailable: false },
                        { new: true }
                    );
                    console.log(`Provider ${provider.email} set to unavailable for the new day.`);
                }
            }

        } catch (error) {
            console.error('Error during daily availability reset:', error);
        }
    });
};