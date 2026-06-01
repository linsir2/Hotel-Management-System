package com.hotel.service.impl;

import com.hotel.dao.RoomDao;
import com.hotel.entity.Room;
import com.hotel.service.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class RoomServiceImpl implements RoomService {

    @Autowired
    private RoomDao roomDao;

    @Override
    public List<Room> getAllRooms() {
        return roomDao.getAllRooms();
    }

    @Override
    public void updateRoomStatus(Integer id, String status) {
        roomDao.updateRoomStatus(id, status);
    }

    @Override
    public void addRoom(Room room) {
        roomDao.createRoom(room);
    }

    @Override
    public void updateRoom(Room room) {
        roomDao.updateRoom(room);
    }

    @Override
    public void deleteRoom(Integer id) {
        roomDao.deleteRoom(id);
    }
}
