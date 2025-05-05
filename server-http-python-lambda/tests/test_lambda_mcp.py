from server.lambda_mcp.lambda_mcp import LambdaMCPServer

def test_dice_roll_basic():
    server = LambdaMCPServer(name="TestServer", create_session_table=False)
    result = server.dice_roll(dice_type="d6", num_dice=2)
    assert len(result["results"]) == 2
    assert all(1 <= r <= 6 for r in result["results"])
    assert result["total"] == sum(result["results"])

def test_dice_roll_invalid_type():
    server = LambdaMCPServer(name="TestServer", create_session_table=False)
    try:
        server.dice_roll(dice_type="d3", num_dice=1)
        assert False, "Should have raised ValueError for invalid dice_type"
    except ValueError:
        pass

def test_dice_roll_invalid_num():
    server = LambdaMCPServer(name="TestServer", create_session_table=False)
    try:
        server.dice_roll(dice_type="d6", num_dice=0)
        assert False, "Should have raised ValueError for num_dice < 1"
    except ValueError:
        pass
