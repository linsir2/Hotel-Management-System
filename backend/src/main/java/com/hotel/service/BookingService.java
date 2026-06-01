package com.hotel.service;

import com.hotel.entity.Booking;
import java.util.List;

public interface BookingService {
    void createBooking(Booking booking);
    List<Booking> getAllBookings();
    void updateBooking(Booking booking);
    void deleteBooking(Integer id);
}
