package com.saarthix.crm.config;

import com.saarthix.crm.domain.Catalog;
import com.saarthix.crm.model.Lead;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class StageMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(StageMigration.class);
    private final MongoTemplate mongo;

    public StageMigration(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments args) {
        Catalog.LEGACY_STAGES.forEach((legacy, current) -> {
            long changed = mongo.updateMulti(
                    Query.query(Criteria.where("stage").is(legacy)),
                    Update.update("stage", current),
                    Lead.class).getModifiedCount();
            if (changed > 0) log.info("Moved {} leads from stage {} to {}", changed, legacy, current);
        });
    }
}
