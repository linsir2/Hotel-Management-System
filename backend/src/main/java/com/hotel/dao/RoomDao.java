package com.hotel.dao;

import com.hotel.entity.Room;
import java.util.List;

public interface RoomDao {
    List<Room> getAllRooms();
    Room getRoomById(Integer id);
    void updateRoomStatus(Integer id, String status);
    void createRoom(Room room);
    void updateRoom(Room room);
    void deleteRoom(Integer id);
    Room getRoomByNumber(String roomNumber);
}
