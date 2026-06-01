package com.hotel.service;

import com.hotel.entity.Guest;
import java.util.List;

public interface GuestService {
    List<Guest> getAllGuests();
    void addGuest(Guest guest);
    void updateGuest(Guest guest);
    void deleteGuest(Integer id);
}
