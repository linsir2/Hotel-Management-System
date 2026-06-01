package com.hotel.dao;

import com.hotel.entity.User;

public interface UserDao {
    User getUserByUsername(String username);
    void createUser(User user);
}
