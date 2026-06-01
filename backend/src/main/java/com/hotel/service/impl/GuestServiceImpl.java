package com.hotel.service.impl;

import com.hotel.dao.GuestDao;
import com.hotel.entity.Guest;
import com.hotel.service.GuestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class GuestServiceImpl implements GuestService {
    @Autowired
    private GuestDao guestDao;

    @Override
    public List<Guest> getAllGuests() {
        return guestDao.getAllGuests();
    }

    @Override
    public void addGuest(Guest guest) {
        guestDao.createGuest(guest);
    }

    @Override
    public void updateGuest(Guest guest) {
        guestDao.updateGuest(guest);
    }

    @Override
    public void deleteGuest(Integer id) {
        guestDao.deleteGuest(id);
    }
}
