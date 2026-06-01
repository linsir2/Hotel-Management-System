package com.hotel.controller;

import com.hotel.entity.Room;
import com.hotel.service.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin // Enable CORS for frontend
public class RoomController {

    @Autowired
    private RoomService roomService;

    @GetMapping
    public List<Room> getAllRooms() {
        return roomService.getAllRooms();
    }

    @PostMapping
    public void addRoom(@RequestBody Room room) {
        roomService.addRoom(room);
    }

    @PutMapping("/{id}")
    public void updateRoom(@PathVariable Integer id, @RequestBody Room room) {
        room.setId(id);
        roomService.updateRoom(room);
    }

    @PutMapping("/{id}/status")
    public void updateStatus(@PathVariable Integer id, @RequestParam String status) {
        roomService.updateRoomStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public void deleteRoom(@PathVariable Integer id) {
        roomService.deleteRoom(id);
    }
}
