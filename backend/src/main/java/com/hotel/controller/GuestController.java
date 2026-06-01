package com.hotel.controller;

import com.hotel.entity.Guest;
import com.hotel.service.GuestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/guests")
public class GuestController {
    @Autowired
    private GuestService guestService;

    @GetMapping
    public List<Guest> getAllGuests() {
        return guestService.getAllGuests();
    }

    @PostMapping
    public void addGuest(@RequestBody Guest guest) {
        guestService.addGuest(guest);
    }

    @PutMapping("/{id}")
    public void updateGuest(@PathVariable Integer id, @RequestBody Guest guest) {
        guest.setId(id);
        guestService.updateGuest(guest);
    }

    @DeleteMapping("/{id}")
    public void deleteGuest(@PathVariable Integer id) {
        guestService.deleteGuest(id);
    }
}
