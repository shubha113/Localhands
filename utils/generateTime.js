export const generateTimeSlots = (workingHours, existingBookings, duration) => {
    const slots = [];
    const startTime = parseTime(workingHours.start);
    const endTime = parseTime(workingHours.end);
    
    let currentTime = startTime;

    while (currentTime + duration <= endTime) {
        const slotStart = currentTime;
        const slotEnd = currentTime + duration;

        // Check if this slot conflicts with any booking
       const hasConflict = existingBookings.some(booking => {
    const bookingStart = booking.scheduledDateTime.getTime();
    const bookingEnd = bookingStart + duration * 60 * 60 * 1000; // assuming same duration

    const slotStartMs = slotStart * 60 * 60 * 1000;
    const slotEndMs = slotEnd * 60 * 60 * 1000;

    return !(bookingEnd <= slotStartMs || bookingStart >= slotEndMs); // overlap check
});


        if (!hasConflict) {
            slots.push({
                start: formatTime(slotStart),
                end: formatTime(slotEnd),
            });
        }

        currentTime += 1;
    }

    return slots;
};

const parseTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
};

//function to format hours to time string
const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};