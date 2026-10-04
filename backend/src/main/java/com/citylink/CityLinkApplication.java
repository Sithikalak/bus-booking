package com.citylink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CityLinkApplication {

  public static void main(String[] args) {
    SpringApplication.run(CityLinkApplication.class, args);
  }
}
