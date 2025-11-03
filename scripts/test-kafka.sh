./opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
./opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic game-taps --from-beginning
./opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic game-updates --from-beginning
./opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic user-metadata --from-beginning