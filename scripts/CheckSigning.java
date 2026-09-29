import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.util.Arrays;
import java.util.Properties;

/** Read-only signing preflight. Never prints credentials or changes the keystore. */
class CheckSigning {
    public static void main(String[] args) {
        try {
            check(Path.of(args[0]).toAbsolutePath());
            System.out.println("PASS: signing keystore, alias, and private-key password are valid.");
        } catch (Exception failure) {
            System.err.println("ERROR: " + failure.getMessage());
            System.exit(1);
        }
    }

    private static void check(Path root) throws Exception {
        Properties properties = new Properties();
        try (var input = Files.newInputStream(root.resolve("keystore.properties"))) {
            properties.load(input);
        } catch (Exception failure) {
            throw new Exception("Cannot read keystore.properties. Copy keystore.properties.example and configure signing.");
        }
        for (String name : new String[]{"storeFile", "storePassword", "keyAlias", "keyPassword"}) {
            String value = properties.getProperty(name, "").trim();
            if (value.isEmpty() || value.equals("CHANGE_ME")) {
                throw new Exception("keystore.properties needs a real value for " + name + ".");
            }
            properties.setProperty(name, value);
        }
        Path file = root.resolve(properties.getProperty("storeFile"));
        if (!Files.isRegularFile(file)) {
            throw new Exception("Signing keystore does not exist. Check storeFile in keystore.properties.");
        }
        char[] storePassword = properties.getProperty("storePassword").toCharArray();
        char[] keyPassword = properties.getProperty("keyPassword").toCharArray();
        try {
            KeyStore store;
            try {
                store = KeyStore.getInstance(file.toFile(), storePassword);
            } catch (Exception failure) {
                throw new Exception("Cannot open the keystore. Check storePassword and storeFile in keystore.properties.");
            }
            String alias = properties.getProperty("keyAlias");
            if (!store.isKeyEntry(alias)) {
                throw new Exception("keyAlias does not identify a private key in this keystore. Check keyAlias in keystore.properties.");
            }
            try {
                if (!(store.getKey(alias, keyPassword) instanceof PrivateKey)) {
                    throw new Exception("Not a private key");
                }
            } catch (Exception failure) {
                throw new Exception("The keystore opens, but its private key cannot be unlocked. Set keyPassword in keystore.properties to the password originally used for this key (which may differ from storePassword). Keep the existing keystore.");
            }
        } finally {
            Arrays.fill(storePassword, '\0');
            Arrays.fill(keyPassword, '\0');
        }
    }
}
