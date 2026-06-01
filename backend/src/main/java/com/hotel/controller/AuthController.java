package com.hotel.controller;

import com.hotel.entity.User;
import com.hotel.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody User loginUser, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        User user = userService.login(loginUser.getUsername(), loginUser.getPassword());
        if (user != null) {
            session.setAttribute("user", user);
            response.put("success", true);
            response.put("user", user);
        } else {
            response.put("success", false);
            response.put("message", "用户名或密码错误");
        }
        return response;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody User user) {
        Map<String, Object> response = new HashMap<>();
        try {
            userService.register(user);
            response.put("success", true);
        } catch (Exception e) {
            e.printStackTrace(); // 在 IDEA 控制台打印具体错误
            response.put("success", false);
            response.put("message", "注册失败: " + e.getMessage());
        }
        return response;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpSession session) {
        session.invalidate();
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        return response;
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        User user = (User) session.getAttribute("user");
        if (user != null) {
            response.put("authenticated", true);
            response.put("user", user);
        } else {
            response.put("authenticated", false);
        }
        return response;
    }

    @PostMapping("/verify-password")
    public Map<String, Object> verifyPassword(@RequestBody Map<String, String> request, HttpSession session) {
        Map<String, Object> response = new HashMap<>();
        User currentUser = (User) session.getAttribute("user");
        String password = request.get("password");

        if (currentUser == null) {
            response.put("success", false);
            response.put("message", "会话已过期，请重新登录");
            return response;
        }

        // 重新调用 login 逻辑验证，确保是从数据库实时校验密码
        User verifiedUser = userService.login(currentUser.getUsername(), password);
        
        if (verifiedUser != null) {
            response.put("success", true);
        } else {
            response.put("success", false);
            response.put("message", "密码错误，请重新输入");
        }
        return response;
    }
}
