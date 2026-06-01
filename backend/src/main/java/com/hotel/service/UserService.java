package com.hotel.service;

import com.hotel.entity.User;

public interface UserService {
    User login(String username, String password);
    void register(User user);
}
