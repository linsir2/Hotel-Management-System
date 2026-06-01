package com.hotel.dao;

import com.hotel.entity.Guest;
import java.util.List;

public interface GuestDao {
    List<Guest> getAllGuests();
    Guest getGuestById(Integer id);
    void createGuest(Guest guest);
    void updateGuest(Guest guest);
    void deleteGuest(Integer id);
    Guest getGuestByName(String name);
}
