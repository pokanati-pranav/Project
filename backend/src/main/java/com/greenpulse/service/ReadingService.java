package com.greenpulse.service;
import com.greenpulse.domain.*;
import com.greenpulse.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;
@Service
public class ReadingService {
 private final ReadingRepository readings;private final BuildingRepository buildings;private final CurrentUser current;
 public ReadingService(ReadingRepository readings,BuildingRepository buildings,CurrentUser current){this.readings=readings;this.buildings=buildings;this.current=current;}
 private Building building(Long id,AppUser u){return buildings.findScoped(id,current.isSuper(u),current.org(u)).orElseThrow(()->new NoSuchElementException("Building not found"));}
 @Transactional public EnergyReading create(Long buildingId,LocalDate date,BigDecimal kwh,String source){if(kwh.signum()<0||kwh.scale()>3)throw new IllegalArgumentException("Energy must be non-negative with at most 3 decimals");AppUser u=current.get();EnergyReading r=new EnergyReading();r.setBuilding(building(buildingId,u));r.setReadingDate(date);r.setEnergyConsumedKwh(kwh);r.setRecordedBy(u);r.setSource(source==null?"MANUAL":source);return readings.save(r);}
 public List<EnergyReading> list(Long buildingId,LocalDate from,LocalDate to){if(from.isAfter(to))throw new IllegalArgumentException("from must be on or before to");AppUser u=current.get();if(buildingId!=null)building(buildingId,u);return readings.range(buildingId,current.isSuper(u),current.org(u),from,to);}
 public List<EnergyReading> byBuilding(Long id){AppUser u=current.get();building(id,u);return readings.byBuilding(id,current.isSuper(u),current.org(u));}
}
