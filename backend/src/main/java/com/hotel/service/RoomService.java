package com.hotel.service;

import com.hotel.entity.Room;
import java.util.List;

public interface RoomService {
    List<Room> getAllRooms();
    void updateRoomStatus(Integer id, String status);
    void addRoom(Room room);
    void updateRoom(Room room);
    void deleteRoom(Integer id);
}
